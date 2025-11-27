import React, { useState } from 'react';

const SelectCategory = ({ 
    categories, 
    selectedCategory, 
    onSelectCategory, 
    difficulties,
    selectedDifficulty,
    onSelectDifficulty,
    onStart, 
    onBack,
    haveamount
}) => {
    const [stakeAmount, setStakeAmount] = useState('');
    const handleStakeChange = (e) => {
        const value = e.target.value;
        // Only allow positive numbers
        if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
            setStakeAmount(value);
        }
    };

    return (
        <div className="game-container select-category-container">
            <h2>Select Category</h2>
            <div className="category-grid">
                {categories.map(cat => (
                    <button 
                        key={cat} 
                        className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => onSelectCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <h2>Select Difficulty</h2>
            <div className="category-grid difficulty-grid">
                {difficulties.map(diff => (
                    <button 
                        key={diff} 
                        className={`category-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                        onClick={() => onSelectDifficulty(diff)}
                    >
                        {diff}
                    </button>
                ))}
            </div>
            
            {haveamount && <div className="stake-input-section">
                <label htmlFor="stake-amount">
                    Stake Amount (ETH)
                </label>
                <input
                    id="stake-amount"
                    type="number"
                    min="0"
                    step="0.001"
                    value={stakeAmount}
                    onChange={handleStakeChange}
                    placeholder="Enter stake amount"
                    className="stake-input"
                />
                {stakeAmount && (
                    <p className="stake-preview">
                        Stake: {stakeAmount} ETH
                    </p>
                )}
            </div>}

            <div className="action-buttons">
                <button onClick={onBack} className="btn-secondary">Back</button>
                <button onClick={onStart} className="btn-primary">Start Quiz</button>
            </div>
        </div>
    );
};

export default SelectCategory;
